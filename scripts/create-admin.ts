import { createInterface } from "node:readline";
import { upsertAdmin } from "@/lib/auth";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const lineIterator = rl[Symbol.asyncIterator]();

function readLine(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  return lineIterator.next().then((r) => (r.done ? "" : r.value));
}

function readPassword(prompt: string): Promise<string> {
  const stdin = process.stdin;

  if (!stdin.isTTY) {
    return readLine(prompt);
  }

  return new Promise((resolve) => {
    process.stdout.write(prompt);
    stdin.resume();
    stdin.setRawMode(true);

    let password = "";

    function onData(buf: Buffer) {
      for (const byte of buf) {
        const char = String.fromCharCode(byte);
        if (char === "\n" || char === "\r") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(password);
          return;
        }
        if (byte === 3) {
          process.stdout.write("\n");
          process.exit(1);
        }
        if (byte === 127 || byte === 8) {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        password += char;
        process.stdout.write("*");
      }
    }

    stdin.on("data", onData);
  });
}

async function main() {
  const username = (await readLine("Identifiant admin: ")).trim();

  if (!username) {
    console.error("Identifiant vide, abandon.");
    process.exit(1);
  }

  const password = (await readPassword("Mot de passe admin: ")).trim();

  if (!password) {
    console.error("Mot de passe vide, abandon.");
    process.exit(1);
  }

  upsertAdmin(username, password);
  console.log(`Compte admin "${username}" cree/mis a jour avec succes.`);
  process.exit(0);
}

main();
