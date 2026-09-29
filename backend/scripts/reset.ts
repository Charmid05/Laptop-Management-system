/** Deletes the SQLite file and rebuilds it from the schema plus sample data. */
import { rmSync } from "node:fs";
import { dbFile } from "../src/db.ts";

for (const suffix of ["", "-wal", "-shm"]) rmSync(`${dbFile}${suffix}`, { force: true });
console.log(`Removed ${dbFile}. Start the backend to recreate and seed it.`);
