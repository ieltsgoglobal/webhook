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
        let TYPE: "B2B_CREDIT_PACKAGE" | "B2C_MEMBERSHIP";

        try {
            const parsed = JSON.parse(metaInfo?.udf1 || "{}");
            orgId = parsed.orgId;
            usersPurchased = parseInt(parsed.usersPurchased);
            TYPE = parsed.TYPE;
        } catch {
            return new Response("Invalid metaInfo", { status: 400 });
        }

        if (!TYPE) {
            return new Response("Missing TYPE in metaInfo", { status: 400 });
        }

        // ------------------------------------------------------------


        switch (TYPE) {
            case "B2B_CREDIT_PACKAGE": {
                if (!orgId || !usersPurchased) {
                    return new Response("Missing metaInfo for B2B_CREDIT_PACKAGE", { status: 400 });
                }

                const result = await addTransactionAndCredits(orgId, usersPurchased, amount / 100);

                if ("error" in result) {
                    return new Response("Failed to update credits", { status: 500 });
                }

                return NextResponse.json({ success: true, handled: TYPE });
            }

            case "B2C_MEMBERSHIP": {
                console.log("Received B2C_MEMBERSHIP payment");
                return NextResponse.json({ success: true, handled: TYPE });
            }

            default:
                return new Response(`Unknown TYPE: ${TYPE}`, { status: 400 });
        }

    } catch (err) {
        return new Response("Invalid webhook signature", { status: 401 });
    }
}