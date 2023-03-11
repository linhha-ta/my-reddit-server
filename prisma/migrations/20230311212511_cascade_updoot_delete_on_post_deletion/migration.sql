-- DropForeignKey
ALTER TABLE "Updoot" DROP CONSTRAINT "Updoot_postId_fkey";

-- AddForeignKey
ALTER TABLE "Updoot" ADD CONSTRAINT "Updoot_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
