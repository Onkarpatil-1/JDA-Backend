
import dotenv from 'dotenv';
import { GeminiService } from './src/services/GeminiService.js';

dotenv.config();

async function testGemini() {
    console.log('🧪 Testing Gemini Connectivity...');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not found in .env');
        return;
    }

    // Hide part of the key for basic internal logging but confirm we have it
    console.log(`🔑 Using key: ${apiKey.substring(0, 5)}...`);

    const gemini = new GeminiService(apiKey, 'gemini-2.0-flash');

    try {
        console.log('📡 Sending request to Gemini...');
        const response = await gemini.generate('Hello Gemini, verify you are working and mention your model name.', {
            temperature: 0.7
        });

        console.log('✅ Gemini Response:');
        console.log(response.content);
        console.log('-------------------');
        console.log(`Model: ${response.model}`);
        console.log(`Response Time: ${response.responseTime}ms`);
    } catch (error) {
        console.error('❌ Gemini Test Failed:');
        console.error(error);
    }
}

testGemini();
