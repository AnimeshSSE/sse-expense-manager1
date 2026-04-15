import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function canApprove(role: string | undefined | null): boolean {
  return role === "STOCK_MANAGER" || role === "ADMIN";
}

function canSendBack(role: string | undefined | null): boolean {
  return role === "STOCK_MANAGER" || role === "ADMIN";
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
        { error: "Only STOCK_MANAGER or ADMIN can approve or reject requisitions" },
        { status: 403 }
      );
    }

    const requisition = await db.requisition.findUnique({ where: { id } });

    if (!requisition) {
      return NextResponse.json(
        { error: "Requisition not found" },
        { status: 404 }
      );
    }

    if (requisition.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: `Cannot ${action} requisition with status ${requisition.status}` },
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

      const updated = await db.requisition.update({
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
          items: true,
        },
      });

      await db.auditLog.create({
        data: {
          action: "SENT_BACK",
          entityType: "REQUISITION",
          entityId: id,
          userId: approverId,
          requisitionId: id,
          details: reason,
        },
      });

      return NextResponse.json({ requisition: updated });
    }

    if (action === "approve") {
      const updated = await db.requisition.update({
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
          items: true,
        },
      });

      await db.auditLog.create({
        data: {
          action: "APPROVED",
          entityType: "REQUISITION",
          entityId: id,
          userId: approverId,
          requisitionId: id,
        },
      });

      return NextResponse.json({ requisition: updated });
    }

    if (action === "reject") {
      if (!reason) {
        return NextResponse.json(
          { error: "Rejection reason is required" },
          { status: 400 }
        );
      }

      const updated = await db.requisition.update({
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
          items: true,
        },
      });

      await db.auditLog.create({
        data: {
          action: "REJECTED",
          entityType: "REQUISITION",
          entityId: id,
          userId: approverId,
          requisitionId: id,
          details: reason,
        },
      });

      return NextResponse.json({ requisition: updated });
    }

    return NextResponse.json({ error: "Invalid action. Use approve, reject, or send_back." }, { status: 400 });
  } catch (error) {
    console.error("Requisition approve/reject error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
