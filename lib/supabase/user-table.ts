// src/lib/supabase/user-table.ts
"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // service role key for server-side updates
);

type UpdateMembershipInput = {
    userId: string;
    membership_type: string;
    durationInDays: number;
    paymentAmount: number;
    paymentDate?: Date;
};

export async function updateUserMembership(input: UpdateMembershipInput) {
    const {
        userId,
        membership_type,
        durationInDays,
        paymentAmount,
        paymentDate = new Date(),
    } = input;

    const membership_started_at = paymentDate.toISOString();
    const membership_expires_at = new Date(
        paymentDate.getTime() + durationInDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
        .from("user")
        .update({
            is_member: true,
            membership_type,
            membership_started_at,
            membership_expires_at,
            membership_status: "ACTIVE",
            last_payment_amount: paymentAmount,
            last_payment_at: paymentDate.toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select("*")
        .single();

    if (error) {
        throw new Error(`Failed to update membership: ${error.message}`);
    }

    return data;
}