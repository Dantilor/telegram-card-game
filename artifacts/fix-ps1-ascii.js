const fs = require("fs");
const p = "C:/Users/User/Desktop/telegram-card-game-2/Import-GnhLegalStaging.ps1";
let t = fs.readFileSync(p, "utf8");
// Fix common UI strings by regex on throw/Write-Host/Prompt lines with non-ascii
t = t.replace(/Read-Host -AsSecureString -Prompt '[^']*'/g, "Read-Host -AsSecureString -Prompt 'Password for gnh_web_migrate (hidden)'");
t = t.replace(/throw '[^']*[^\x00-\x7F][^']*'/g, (m) => {
  if (/Empty|????|????????/i.test(m)) return "throw 'Empty password.'";
  if (/not received|?? ???????|???? ??????/i.test(m)) return "throw 'Password not received.'";
  if (/Preflight|?? ??????????|???? ??????/i.test(m)) return "throw 'Preflight did not confirm gnh_web_staging / gnh_web_migrate / TLS.'";
  return "throw 'Operation failed.'";
});
t = t.replace(/Write-Host "[^"]*[^\x00-\x7F][^"]*"/g, (m) => {
  if (/active|?????/i.test(m)) return 'Write-Host "Documents already active. Log: $gnhLog"';
  if (/Enter|???????|Enter/i.test(m)) return 'Write-Host "Press Enter to close."';
  if (/Done|??????/i.test(m)) return 'Write-Host "Done. Log: $gnhLog"';
  if (/Error|??????/i.test(m)) return 'Write-Host "Error. Log: $gnhLog"';
  return 'Write-Host "OK"';
});
t = t.replace(/Write-Log '[^']*[^\x00-\x7F][^']*'/g, (m) => {
  if (/already active|?????/i.test(m) || /SHA/i.test(m)) return "Write-Log 'Core docs already active with matching SHA - skip backup/import/activate'";
  return "Write-Log 'step'";
});
// also em dash
t = t.replace(/\u2014/g, "-");
fs.writeFileSync(p, t, "utf8");
console.log("rewrote", p, t.length);
