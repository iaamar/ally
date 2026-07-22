#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createState } from './state.js';
import { buildServer } from './server.js';

const state = createState();
const server = buildServer(state);
const transport = new StdioServerTransport();
await server.connect(transport);
