import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST() {
  try {
    const session = await getSession();

    if (session) {
      await db.user.update({
        where: { id: session.id },
        data: { token: null, tokenExpiry: null },
      });
    }

    const response = NextResponse.json({ message: 'Logged out successfully' });

    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
