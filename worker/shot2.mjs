import { chromium } from 'playwright';
const b=await chromium.connectOverCDP('http://127.0.0.1:9333'); const p=await b.contexts()[0].newPage();
await p.goto('http://localhost:3010/catalog',{waitUntil:'domcontentloaded',timeout:45000}); await p.waitForTimeout(5000);
await p.screenshot({path:process.env.HOME+'/.albunyaan-cc/catalog-fixed.png'});
await p.close(); process.exit(0);
