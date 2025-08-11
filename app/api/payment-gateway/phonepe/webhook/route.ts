// File: app/api/payment-gateway/phonepe/webhook/route.ts
import { addTransactionAndCredits } from "@/lib/supabase/transaction-table";
import { NextRequest, NextResponse } from "next/server";
import { StandardCheckoutClient, Env } from "pg-sdk-node";

const clientId = process.env.PHONEPE_CLIENT_ID!;
const clientSecret = process.env.PHONEPE_CLIENT_SECRET!;
const clientVersion = 1;
const env = Env.PRODUCTION; // Use Env.PRODUCTION in live , Env.SANDBOX; in dev

const client = StandardCheckoutClient.getInstance(
    clientId,
    clientSecret,
    clientVersion,
    env
);

const webhookUsername = process.env.PHONEPE_CALLBACK_USERNAME!;
const webhookPassword = process.env.PHONEPE_CALLBACK_PASSWORD!;

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    const rawBody = await req.text(); // Important: must use text() for signature validation

    if (!authHeader) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        // Validate webhook signature
        const callbackResponse = client.validateCallback(
            webhookUsername,
            webhookPassword,
            authHeader,
            rawBody
        );

        const payload = callbackResponse.payload;
        const { state, amount, metaInfo } = payload;

        if (state !== "COMPLETED") {
            return NextResponse.json({ status: "ignored", reason: "payment not completed" });
        }


        /// -----------  EXTRACT DATA FORM META INFO ----------------

        let orgId: string | undefined;
        let usersPurchased: number | undefined;

        try {
            const parsed = JSON.parse(metaInfo?.udf1 || "{}");
            orgId = parsed.orgId;
            usersPurchased = parseInt(parsed.usersPurchased);
        } catch {
            return new Response("Invalid metaInfo", { status: 400 });
        }

        if (!orgId || !usersPurchased) {
            return new Response("Missing metaInfo", { status: 400 });
        }

        // ------------------------------------------------------------



        // Add credits + transaction
        const result = await addTransactionAndCredits(orgId, usersPurchased, amount / 100);

        if ("error" in result) {
            return new Response("Failed to update credits", { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return new Response("Invalid webhook signature", { status: 401 });
    }
}