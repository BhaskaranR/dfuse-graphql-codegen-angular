const { lstatSync, readdirSync, existsSync, mkdirSync } = require('fs');
const { resolve, join, relative } = require('path');
const { createDfuseClient } = require("@dfuse/client");
const  fetch  = require("node-fetch");
const { generate } = require('@graphql-codegen/cli');

const ws = require("ws");
require('dotenv').config();

global.WebSocket = ws;
global.fetch = fetch;

function listLibs() {
  const libs = resolve(__dirname, 'schemas');
  const isDirectory = source => lstatSync(source).isDirectory();
  return readdirSync(libs)
    .map(name => join(libs, name))
    .filter(isDirectory)
    .map(source => relative(libs, source));
}

if (process.env.DFUSE_API_KEY == null) {
  console.log("Missing DFUSE_API_KEY environment variable")
  process.exit(1)
}

const dfuseClient = createDfuseClient({
  apiKey: process.env.DFUSE_API_KEY,
  network: "mainnet",
});

const connectionParams = async () => {
  const { token } = await dfuseClient.getTokenInfo();
  return {
    Authorization: `Bearer ${token}`
  }
}

function generateLib(lib) {
  const generatedDirPath = `generated`;
  if (!existsSync(generatedDirPath)) {
    mkdirSync(generatedDirPath);
  }
  return {
    output: resolve(__dirname, `./generated/${lib}/graphql.ts`),
    config: {
      documents: `./schemas/${lib}/**/*.graphql`,
      plugins: [
        'typescript-common',
        'typescript-client',
        'typescript-apollo-angular'
      ]
    }
  };
}


async function main() {
  const token = await connectionParams();
  console.log({
    schema: {
      "https://mainnet.eos.dfuse.io/graphql" :{
      headers: token}
    },
    overwrite: true,
    generates: listLibs()
      .map(generateLib)
      .reduce(
        (generates, lib) => ({
          ...generates,
          [lib.output]: lib.config
        }),
        {}
      )
  });
  return await generate(
    {
      schema: {
        "https://mainnet.eos.dfuse.io/graphql" :{
        headers: token}
      },
      overwrite: true,
      generates: listLibs()
        .map(generateLib)
        .reduce(
          (generates, lib) => ({
            ...generates,
            [lib.output]: lib.config
          }),
          {}
        )
    }, true);
}

main().then((val) => {
  console.log("Completed")
  process.exit(0)
}).catch((error) => {
  console.log("An error occurred", error)
  process.exit(1)
})