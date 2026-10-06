-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
