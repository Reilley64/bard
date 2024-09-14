import { type App } from "../../../index.ts";
import { treaty } from "@elysiajs/eden";

const server = treaty<App>(window.location.protocol + "//" + window.location.host);

export default server;
