/**
 * Telegram Notification Service
 */

// Replace these with your actual Bot Token and Chat ID
// You can get the Bot Token from @BotFather
// You can get your Chat ID from @userinfobot or by checking the bot API updates
const TELEGRAM_BOT_TOKEN = '8476439265:AAFP5HJLokAo9XZbpz5Lzgf_BxczgnX_xro'; 
const TELEGRAM_CHAT_ID = '-1003813784139'; 

const TOPIC_REPORT = 2;
const TOPIC_ERROR = 3;

export async function sendTelegramNotification(message: string, isError: boolean = false) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram Bot Token or Chat ID is not configured.");
    return;
  }

  const threadId = isError ? TOPIC_ERROR : TOPIC_REPORT;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        message_thread_id: threadId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to send Telegram notification:", errorData);
    }
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
  }
}

export function formatExpenseMessage(
  action: 'Created' | 'Updated' | 'Deactivated' | 'Activated' | 'Error',
  data: any,
  stats: { monthlyIncome: number; monthlyExpense: number },
  error?: string
) {
  const emoji = action === 'Created' ? '📝' : action === 'Updated' ? '✏️' : action === 'Deactivated' ? '🗑️' : action === 'Activated' ? '✅' : '⚠️';
  const typeEmoji = data.Type === 'Income' ? '💰' : '💸';
  
  let message = `<b>${emoji} Expense Report ${action}</b>

`;

  if (action === 'Error') {
    message += `❌ <b>Error:</b> ${error}
`;
  } else {
    message += `${typeEmoji} <b>Type:</b> ${data.Type}
`;
    message += `📅 <b>Date:</b> ${data.Date || 'N/A'}
`;
    message += `💬 <b>Description:</b> ${data.Description || 'N/A'}
`;
    message += `💵 <b>Amount:</b> $${parseFloat(data.Amount || 0).toLocaleString()}
`;
    message += `💳 <b>Method:</b> ${data["Payment Method"] || 'N/A'}
`;
  }

  message += `
--------------------------
`;
  message += `📊 <b>Monthly Summary (${new Date().toLocaleString('default', { month: 'long' })})</b>
`;
  message += `🟢 <b>Income:</b> $${stats.monthlyIncome.toLocaleString()}
`;
  message += `🔴 <b>Expense:</b> $${stats.monthlyExpense.toLocaleString()}
`;
  message += `⚖️ <b>Balance:</b> $${(stats.monthlyIncome - stats.monthlyExpense).toLocaleString()}
`;

  return message;
}
