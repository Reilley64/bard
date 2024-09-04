import { type App } from "../../../index.ts";
import { treaty } from "@elysiajs/eden";

const server = treaty<App>("localhost:3000");

export default server;
