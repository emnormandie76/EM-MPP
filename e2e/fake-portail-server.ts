// The fake portal of the end-to-end tests (architecture §9.4), started by playwright.config.ts.
import { startFakePortail } from "../tests/helpers/fake-portail";

const portail = await startFakePortail({ port: Number(process.argv[2]) });
console.log(`Faux portail prêt : ${portail.issuer}`);
