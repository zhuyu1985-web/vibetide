/**
 * 将 user_profiles.phone 明文迁移为 AES 加密 + phone_hash 查重字段。
 * 用法: pnpm exec tsx scripts/migrate-phone-encryption.ts
 */
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import {
  decryptPhone,
  isEncryptedPhone,
  preparePhoneForStorage,
} from "@/lib/phone-crypto";

async function main() {
  const rows = await db.query.userProfiles.findMany({
    where: isNotNull(userProfiles.phone),
    columns: { id: true, phone: true, phoneHash: true },
  });

  let updated = 0;
  for (const row of rows) {
    if (!row.phone) continue;

    const plain = decryptPhone(row.phone);
    if (!plain) continue;

    const { phone, phoneHash } = preparePhoneForStorage(plain);
    const alreadyDone =
      isEncryptedPhone(row.phone) && row.phoneHash === phoneHash;
    if (alreadyDone) continue;

    await db
      .update(userProfiles)
      .set({ phone, phoneHash, updatedAt: new Date() })
      .where(eq(userProfiles.id, row.id));
    updated++;
    console.log(`encrypted phone for user ${row.id}`);
  }

  console.log(`done: ${updated} row(s) updated, ${rows.length} total with phone`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
