import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    // 東京の現在の天気を取得
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=Tokyo&appid=${apiKey}&units=metric&lang=ja`
    );

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json({
      temperature: Math.round(data.main.temp),
      description: data.weather[0].description,
      humidity: data.main.humidity,
      city: data.name
    });

  } catch (error) {
    console.error("Weather API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}
