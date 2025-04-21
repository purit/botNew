// 📁 api/webhook.js
const express = require('express')
const { middleware, Client } = require('@line/bot-sdk')
const fs = require('fs')
const path = require('path')
const pdfParse = require('pdf-parse')
const axios = require('axios')
require('dotenv').config()

const router = express.Router()

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
}

const client = new Client(config)

async function readPDFsFromFolder(folderPath) {
  let allText = ''
  const files = fs.readdirSync(folderPath)
  for (const file of files) {
    if (file.endsWith('.pdf')) {
      const filePath = path.join(folderPath, file)
      const dataBuffer = fs.readFileSync(filePath)
      const data = await pdfParse(dataBuffer)
      allText += data.text + '\n'
    }
  }
  return allText.trim()
}

async function queryOpenRouter(question, context) {
  const headers = {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  }
  const data = {
    model: 'deepseek/deepseek-r1:free',
    messages: [
      {
        role: 'user',
        content: `จากข้อมูลนี้: ${context}\n\nตอบคำถาม: ${question}`,
      },
    ],
  }

  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', data, { headers })
    return response.data.choices[0].message.content
  } catch (error) {
    console.error('OpenRouter error:', error)
    return 'ขออภัย ระบบไม่สามารถเชื่อมต่อกับ AI ได้ในขณะนี้'
  }
}

router.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text
      const context = await readPDFsFromFolder(path.join(__dirname, '../pdfs'))
      const reply = await queryOpenRouter(userMessage, context)

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: reply,
      })
    }
  }

  res.status(200).send('OK')
})

module.exports = router
