-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BooruConfig" (
    "reference_id" TEXT NOT NULL PRIMARY KEY,
    "min_score" INTEGER,
    "allow_nsfw" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_BooruConfig" ("min_score", "reference_id") SELECT "min_score", "reference_id" FROM "BooruConfig";
DROP TABLE "BooruConfig";
ALTER TABLE "new_BooruConfig" RENAME TO "BooruConfig";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
