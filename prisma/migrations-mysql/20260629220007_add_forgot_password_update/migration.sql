-- AlterTable
ALTER TABLE `users` ADD COLUMN `submissionCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `submissionLimit` INTEGER NULL;
