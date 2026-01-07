import prisma from "../lib/Ds.js";

export class chatService {

    /**
     * Create a new conversation for a user.
     * @param {string} userId - The ID of the user.
     * @param {string} mode  -chat, tool, agent
     * @param {string} title - Optional title for the conversation.
     */

    async createConversation(userId:any, mode:string= "chat", title = null) {
         return prisma.conversation.create({
             data:{
                    userId,
                    mode,
                    title: title || `New ${mode} Conversation`,
             }
         })
    }

    /**
     * Get all conversations for a user.
     * @param {string} userId - The ID of the user.
     * @param {string} conversationId - Optional conversation ID to filter.
     * @param {string} mode - Optional mode to filter.
     */

    async getOrCreateConversation(userId:string, conversationId:string | null = null, mode = "chat") {
          if(conversationId){
              const conversation = await prisma.conversation.findFirst({
                where:{
                    id: conversationId,
                    userId
                },
                include:{
                    messages: {
                        orderBy: {
                            createdAt: 'asc'
                        }
                    }
                }
              });

              if(conversation) return conversation;
          }  

          const newConversation = await this.createConversation(userId, mode);
          
          return {
              ...newConversation,
              messages: []
          };
    }

    /**
     * Add a message to a conversation.
     * @param {string} conversationId - The ID of the conversation.
     * @param {string} role - The role of the message sender (e.g., 'user', 'assistant
     * @param {string | object} content - The content of the message.
     */

    async addMessage(conversationId:any, role:any, content:any) {
        const contentStr = typeof content === 'string'
        ? content
        : JSON.stringify(content);

        return await prisma.message.create({
            data:{
                conversationId,
                role,
                content: contentStr
            }
        })
    }
    
    /**Get all conversations for a user.
     * @param {string} conversationId - Conversation ID.
     */

    async getMessages(conversationId:any) {
        const messages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' }
        });
        return messages.map((msg)=> ({
            ...msg,
            content: this.parseContent(msg.content)
        }));
    }

     /**
     * Parse message content (convert JSON string back to object if needed)
     * @param {string} content - The content string to parse
     */
    private parseContent(content: string) {
        try {
            return JSON.parse(content);
        } catch {
            return content;
        }
    }

    /**
     * Get all conversations for a user.
     * @param {string} userId - The ID of the user.
     */

    async getuserConversations(userId:any) {
         return await prisma.conversation.findMany({
              where:{userId},
              orderBy: {updatedAt: 'desc'},
              include:{
                    messages: {
                        take:1,
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
              }
         })
    }

    /**
     * Delete a conversation by ID.
     * @param {string} conversationId - The ID of the conversation to delete.
     * @param {string} userId - The ID of the user.
     */

    async deleteConversation(conversationId:any, userId:any) {
        return await prisma.conversation.deleteMany({
            where:{
                id: conversationId,
                userId
            }
        })
    }

    /**
     * Update conversation title.
     * @param {string} conversationId - The ID of the conversation.
     * @param {string} title - The new title for the conversation.
     */

    async updateTitle(conversationId:any, title:any) {
        return await prisma.conversation.update({
             where: {id : conversationId},
             data: {title}
        })
    }

    /**
     * Format message content before saving.
     * @param {Array} messages - The content of the message.
     */

    formatMessages(messages:any[]) {
        return messages.map((msg) => ({
            role: msg.role,
            content: typeof msg.content === 'string'
                ? msg.content
                : JSON.stringify(msg.content)
        }))
    }
}

