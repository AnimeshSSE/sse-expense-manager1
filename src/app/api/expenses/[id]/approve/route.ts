import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Helper: check if user has approval permission
function canApprove(role: string | undefined | null): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

function canSendBack(role: string | undefined | null): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

// POST /api/expenses/[id]/approve
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
        { error: "Only MANAGER or ADMIN can approve, reject, or send back expenses" },
        { status: 403 }
      );
    }

    const expense = await db.expense.findUnique({ where: { id } });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    if (expense.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: `Cannot ${action} expense with status ${expense.status}` },
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

      const updated = await db.expense.update({
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
          items: { include: { category: true } },
        },
      });

      await db.auditLog.create({
        data: {
          action: "SENT_BACK",
          entityType: "EXPENSE",
          entityId: id,
          userId: approverId,
          expenseId: id,
          details: reason,
        },
      });

      return NextResponse.json({ expense: updated });
    }

    if (action === "approve") {
      const updated = await db.expense.update({
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
          items: { include: { category: true } },
        },
      });

      // Create audit log
      await db.auditLog.create({
        data: {
          action: "APPROVED",
          entityType: "EXPENSE",
          entityId: id,
          userId: approverId,
          expenseId: id,
        },
      });

      return NextResponse.json({ expense: updated });
    }

    if (action === "reject") {
      if (!reason) {
        return NextResponse.json(
          { error: "Rejection reason is required" },
          { status: 400 }
        );
      }

      const updated = await db.expense.update({
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
          items: { include: { category: true } },
        },
      });

      // Create audit log
      await db.auditLog.create({
        data: {
          action: "REJECTED",
          entityType: "EXPENSE",
          entityId: id,
          userId: approverId,
          expenseId: id,
          details: reason,
        },
      });

      return NextResponse.json({ expense: updated });
    }

    return NextResponse.json({ error: "Invalid action. Use approve, reject, or send_back." }, { status: 400 });
  } catch (error) {
    console.error("Expense approve/reject error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
