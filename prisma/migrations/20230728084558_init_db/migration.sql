-- CreateTable
CREATE TABLE "booru_config" (
    "reference_id" TEXT NOT NULL PRIMARY KEY,
    "min_score" INTEGER,
    "allow_nsfw" BOOLEAN NOT NULL DEFAULT false,
    "is_guild" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "tag" (
    "reference_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    PRIMARY KEY ("reference_id", "name"),
    CONSTRAINT "tag_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "booru_config" ("reference_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "site" (
    "reference_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    PRIMARY KEY ("reference_id", "name"),
    CONSTRAINT "site_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "booru_config" ("reference_id") ON DELETE CASCADE ON UPDATE CASCADE
);
