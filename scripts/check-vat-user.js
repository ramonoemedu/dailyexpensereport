const admin = require("firebase-admin");
const sa = require("../serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

(async () => {
  const uid = "cWGl75BtM3fNBp9UjPyQZ4CMCcQ2";
  const fam1 = "HfLedbulpkLaeFMXwkVK";
  const fam2 = "noStutj06Gm5h4nuJ1oV";

  const [m1, m2] = await Promise.all([
    db.collection("families").doc(fam1).collection("members").doc(uid).get(),
    db.collection("families").doc(fam2).collection("members").doc(uid).get(),
  ]);
  console.log("MyFamily(HfLedb) member exists:", m1.exists, m1.exists ? JSON.stringify(m1.data()) : "");
  console.log("VAT(noStutj) member exists:", m2.exists, m2.exists ? JSON.stringify(m2.data()) : "");

  // All system_users
  const all = await db.collection("system_users").get();
  console.log("\nAll system_users:");
  for (const d of all.docs) {
    const x = d.data() || {};
    console.log(` id=${d.id} username=${x.username} families=${JSON.stringify(Object.keys(x.families || {}))}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
