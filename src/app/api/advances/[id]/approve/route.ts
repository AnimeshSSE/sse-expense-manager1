import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function canApprove(role: string | undefined | null): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

function canSendBack(role: string | undefined | null): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, approverId, approverRole, reason } = body;

    if (!approverId || !action) {
      return NextResponse.json(
        { error: "Approver ID and action are required" },
        { status: 400 }
      );
    }

    if (!canApprove(approverRole)) {
      return NextResponse.json(
        { error: "Only MANAGER or ADMIN can approve, reject, or send back advances" },
        { status: 403 }
      );
    }

    const advance = await db.advance.findUnique({ where: { id } });

    if (!advance) {
      return NextResponse.json({ error: "Advance not found" }, { status: 404 });
    }

    if (advance.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: `Cannot ${action} advance with status ${advance.status}` },
        { status: 400 }
      );
    }

    if (action === "send_back") {
      if (!reason) {
        return NextResponse.json(
          { error: "Reason is required for sending back" },
          { status: 400 }
        );
      }

      const updated = await db.advance.update({
        where: { id },
        data: {
          status: "DRAFT",
          approvedById: approverId,
          approvedAt: new Date(),
          rejectedReason: reason,
        },
        include: {
          user: { select: { id: true, name: true, email: true, department: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      });

      await db.auditLog.create({
        data: {
          action: "SENT_BACK",
          entityType: "ADVANCE",
          entityId: id,
          userId: approverId,
          advanceId: id,
          details: reason,
        },
      });

      return NextResponse.json({ advance: updated });
    }

    if (action === "approve") {
      const updated = await db.advance.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: approverId,
          approvedAt: new Date(),
          rejectedReason: null,
        },
        include: {
          user: { select: { id: true, name: true, email: true, department: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      });

      await db.auditLog.create({
        data: {
          action: "APPROVED",
          entityType: "ADVANCE",
          entityId: id,
          userId: approverId,
          advanceId: id,
        },
      });

      return NextResponse.json({ advance: updated });
    }

    if (action === "reject") {
      if (!reason) {
        return NextResponse.json(
          { error: "Rejection reason is required" },
          { status: 400 }
        );
      }

      const updated = await db.advance.update({
        where: { id },
        data: {
          status: "REJECTED",
          approvedById: approverId,
          approvedAt: new Date(),
          rejectedReason: reason,
        },
        include: {
          user: { select: { id: true, name: true, email: true, department: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      });

      await db.auditLog.create({
        data: {
          action: "REJECTED",
          entityType: "ADVANCE",
          entityId: id,
          userId: approverId,
          advanceId: id,
          details: reason,
        },
      });

      return NextResponse.json({ advance: updated });
    }

    return NextResponse.json({ error: "Invalid action. Use approve, reject, or send_back." }, { status: 400 });
  } catch (error) {
    console.error("Advance approve/reject error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
