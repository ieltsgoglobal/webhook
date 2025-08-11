// lib/partner-function.ts
"use server"

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Use Service Role key securely on the server side only
)

// Add transaction and increase credits
export async function addTransactionAndCredits(orgId: string, usersPurchased: number, amountReceived: number): Promise<{ success: true } | { error: string }> {
    const { error: txnError } = await supabase.from("transaction").insert({
        org_id: orgId,
        users_purchased: usersPurchased,
        amount_received: amountReceived,
    })

    if (txnError) {
        return { error: "Failed to insert transaction." }
    }

    // Fetch current credits
    const { data: org, error: orgError } = await supabase
        .from("organization")
        .select("credits")
        .eq("id", orgId)
        .single()

    if (orgError || !org) {
        return { error: "Failed to fetch organization credits." }
    }

    const currentCredits = org.credits ?? 0
    const updatedCredits = currentCredits + usersPurchased

    // Update credits
    const { error: creditUpdateError } = await supabase
        .from("organization")
        .update({ credits: updatedCredits })
        .eq("id", orgId)

    if (creditUpdateError) {
        return { error: "Failed to update credits." }
    }

    return { success: true }
}
