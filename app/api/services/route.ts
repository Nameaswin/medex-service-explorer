import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
    try {
        const filePath = path.join(
            process.cwd(),
            "data",
            "medex.json"
        );

        const fileContents = await readFile(filePath, "utf-8");
        const data = JSON.parse(fileContents);

        return NextResponse.json(data);
    } catch (error) {
        console.error("Failed to load MedEx data:", error);

        return NextResponse.json(
            { error: "Failed to load service data" },
            { status: 500 }
        );
    }
}