import * as dotenv from "dotenv";
dotenv.config();

import { createCLI } from "./cli/parser.js";

createCLI().parse();