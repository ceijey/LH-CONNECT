const fs = require('fs');
const content = fs.readFileSync('app/(admin)/admin/payments/manual/manual-payment.module.css', 'utf8');

let balance = 0;
let lineNum = 1;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '\n') lineNum++;
  if (content[i] === '{') {
    balance++;
    // console.log(`{ on line ${lineNum}, balance = ${balance}`);
  } else if (content[i] === '}') {
    balance--;
    // console.log(`} on line ${lineNum}, balance = ${balance}`);
  }
}
console.log('Final balance:', balance);
