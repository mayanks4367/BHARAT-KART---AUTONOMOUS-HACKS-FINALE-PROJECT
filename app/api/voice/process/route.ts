import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function POST(request: NextRequest) {
    console.log("--- Voice Processing Start ---")
    const apiKey = process.env.GEMINI_API_KEY || ""
    
    if (!apiKey) {
        console.error("CRITICAL: GEMINI_API_KEY is missing from environment variables")
        return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    
    try {
        const formData = await request.formData()
        const audioFile = formData.get("audio") as File

        if (!audioFile) {
            console.error("Error: No audio file in formData")
            return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
        }

        console.log(`Audio file received: ${audioFile.name}, Size: ${audioFile.size}, Type: ${audioFile.type}`)

        // Convert audio to base64
        const audioBuffer = await audioFile.arrayBuffer()
        const audioBase64 = Buffer.from(audioBuffer).toString("base64")
        
        console.log("Audio converted to Base64, length:", audioBase64.length)

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

        const prompt = `You are assisting an Indian artisan in creating a product listing for their handcrafted item.

The artisan has provided an audio description of their product. Please:
1. Transcribe the spoken content
2. Extract structured product information
3. Preserve all cultural terms and craft-specific vocabulary
4. Do not invent or assume any details not mentioned

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.

Required JSON structure:
{
  "transcription": "Full transcription of the audio in the original language with English translation",
  "product_name": "Name of the product (e.g., Handwoven Bandhani Dupatta)",
  "description": "Detailed product description",
  "craft_type": "Type of craft (e.g., Bandhani, Block Printing, Pottery)",
  "material": "Primary material used",
  "state": "Indian state of origin",
  "cultural_tags": ["Array", "of", "relevant", "tags"],
  "language_detected": "Language spoken in the audio",
  "suggested_price": "Suggested price range in INR if mentioned, otherwise null",
  "confidence_score": "0.0 to 1.0 confidence in extraction accuracy"
}

If you cannot extract certain fields, set them to null. Always provide the transcription.`

        const mimeType = audioFile.type.split(';')[0] || "audio/webm"
        console.log("Cleaning MIME Type to:", mimeType)

        console.log("Calling Gemini API...")
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: mimeType,
                    data: audioBase64
                }
            },
            { text: prompt }
        ])

        console.log("Gemini API call successful")
        const response = await result.response
        const text = response.text()
        console.log("Raw AI response length:", text.length)

        // Parse the JSON response
        let extractedData
        try {
            const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
            extractedData = JSON.parse(cleanedText)
            console.log("JSON parsing successful")
        } catch (parseError) {
            console.error("JSON Parse Error. Raw Text:", text)
            return NextResponse.json({
                success: false,
                error: "Failed to parse AI response",
                raw_response: text
            }, { status: 422 })
        }

        return NextResponse.json({
            success: true,
            data: extractedData
        })

    } catch (error: any) {
        console.error("UNHANDLED VOICE PROCESSING ERROR:", error)
        console.error("Error Name:", error.name)
        console.error("Error Message:", error.message)
        if (error.stack) console.error("Stack Trace:", error.stack)

        return NextResponse.json(
            { error: "Failed to process audio", details: error.message },
            { status: 500 }
        )
    }
}