const fs = require('fs');
let c = fs.readFileSync('src/pages/dashboards/AdminRestaurantList.tsx', 'utf8');

c = c.replace(/expected\.set\(\$\{t\.surveillant_id\}_, /g, 'expected.set(`\${t.surveillant_id}_\${t.repas}`, ');
c = c.replace(/expected\.set\(\$\{a\.surveillant_id\}_, /g, 'expected.set(`\${a.surveillant_id}_\${a.repas}`, ');
c = c.replace(/logsBySurvRepas\.set\(\$\{l\.surveillant_id\}_, /g, 'logsBySurvRepas.set(`\${l.surveillant_id}_\${l.repas}`, ');
c = c.replace(/logsBySurvRepas\.get\(\$\{e\.surveillant_id\}_\) /g, 'logsBySurvRepas.get(`\${e.surveillant_id}_\${e.repas}`) ');
c = c.replace(/expected\.has\(\$\{l\.surveillant_id\}_\)/g, 'expected.has(`\${l.surveillant_id}_\${l.repas}`)');

c = c.replace(/className=\{rounded-xl border p-4 space-y-3 \$\{cardBg\}\}/g, 'className={`rounded-xl border p-4 space-y-3 \${cardBg}`}');
c = c.replace(/className=\{h-4 w-4 \$\{iconColor\} shrink-0\}/g, 'className={`h-4 w-4 \${iconColor} shrink-0`}');
c = c.replace(/className=\{inline-flex items-center justify-center text-xs font-bold px-3 py-1 rounded-full \$\{badgeColor\}\}/g, 'className={`inline-flex items-center justify-center text-xs font-bold px-3 py-1 rounded-full \${badgeColor}`}');

fs.writeFileSync('src/pages/dashboards/AdminRestaurantList.tsx', c, 'utf8');
console.log('Fixed');
