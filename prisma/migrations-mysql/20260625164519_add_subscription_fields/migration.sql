-- CreateTable
CREATE TABLE `pending_registrations` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `plan` ENUM('MONTHLY', 'YEARLY') NOT NULL,
    `status` ENUM('CREATED', 'CHECKOUT_CREATED', 'PAID', 'CODE_SENT', 'VERIFIED', 'EXPIRED') NOT NULL DEFAULT 'CREATED',
    `stripeSessionId` VARCHAR(191) NULL,
    `stripeCustomerId` VARCHAR(191) NULL,
    `stripeSubId` VARCHAR(191) NULL,
    `codeHash` VARCHAR(191) NULL,
    `codeExpiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pending_registrations_email_key`(`email`),
    UNIQUE INDEX `pending_registrations_stripeSessionId_key`(`stripeSessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
