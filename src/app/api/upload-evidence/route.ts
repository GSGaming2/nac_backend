import { NextResponse } from "next/server";

import { requireAuth } from "@/app/lib/requireAuth";
import { prisma } from "@/app/lib/prisma";

import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_FILES,
  MAX_UPLOAD_SIZE,
} from "@/app/lib/constants/upload";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();

    if (auth.type !== "user") return NextResponse.json({
          status: "error",
          message: "Only users can upload evidence.",
        },{ status: 403 }
      );

    const user = await prisma.user.findUnique({
      where: {
        id: Number(auth.sub),
      },
      select: {
        id: true,
        subscriptionStatus: true,
      },
    });

    if (!user) return NextResponse.json({
          status: "error",
          message: "User not found.",
        },{ status: 404 }
      );
    

    if (user.subscriptionStatus !== "ACTIVE") return NextResponse.json({
          status: "error",
          message: "Subscription inactive.",
        },{ status: 403 }
      );

    const formData = await req.formData();

    const files = formData.getAll("files") as File[];

    if (files.length === 0) return NextResponse.json(
        {
          status: "error",
          message: "No files uploaded.",
        },{ status: 400 }
      );
    

    if (files.length > MAX_UPLOAD_FILES) return NextResponse.json(
        {
          status: "error",
          message: `Maximum ${MAX_UPLOAD_FILES} files allowed.`,
        },{ status: 400 }
      );

    const uploadedUrls: string[] = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        continue;
      }

      if (!ALLOWED_UPLOAD_TYPES.includes(file.type as any)) 
        return NextResponse.json({
            status: "error",
            message: `${file.name} is not a supported file type.`,
          },{ status: 400 }
        );
      

      if (file.size > MAX_UPLOAD_SIZE) return NextResponse.json({
            status: "error",
            message: `${file.name} exceeds the 10MB limit.`,
          },{ status: 400 }
        );
      
      const ghlForm = new FormData();

      ghlForm.append("file", file);

      ghlForm.append(
        "locationId",
        process.env.GHL_LOCATION_ID!
      );

      const response = await fetch(
        "https://services.leadconnectorhq.com/medias/upload-file",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GHL_ACCESS_TOKEN}`,
            Version: "2021-07-28",
          },
          body: ghlForm,
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error(text);
        return NextResponse.json({
            status: "error",
            message: "Failed to upload file to GoHighLevel.",
          },{ status: 502 }
        );
      }

      const result = await response.json();

      console.log(result);

      /**
       * We'll adjust this once we know the exact
       * response shape.
       */

      uploadedUrls.push(
        result.url ??
          result.fileUrl ??
          result.media?.url ??
          result.data?.url ??
          ""
      );
    }

    return NextResponse.json({
      status: "ok",
      urls: uploadedUrls.filter(Boolean),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "NOT_AUTHENTICATED"
    ) {
      return NextResponse.json(
        {
          status: "error",
          message: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    console.error("Upload Evidence Error:", error);

    return NextResponse.json({
        status: "error",
        message: "Internal server error.",
      },{ status: 500 }
    );
  }
}