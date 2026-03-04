/*
  Warnings:

  - Made the column `nameLower` on table `Participant` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameLower" TEXT NOT NULL,
    "isRegular" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Participant" ("createdAt", "id", "isRegular", "name", "nameLower") SELECT "createdAt", "id", "isRegular", "name", "nameLower" FROM "Participant";
DROP TABLE "Participant";
ALTER TABLE "new_Participant" RENAME TO "Participant";
CREATE UNIQUE INDEX "Participant_name_key" ON "Participant"("name");
CREATE UNIQUE INDEX "Participant_nameLower_key" ON "Participant"("nameLower");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
