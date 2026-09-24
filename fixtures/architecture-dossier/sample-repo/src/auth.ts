import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import bcrypt from 'bcryptjs';
import { clientPromise } from '@/lib/db';
import { User } from '@/models/User';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  session: { strategy: 'jwt' },
  providers: [
    Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }),
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (c) => {
        const user = await User.findOne({ email: String(c.email) });
        if (!user || !(await bcrypt.compare(String(c.password), user.passwordHash))) return null;
        return { id: String(user._id), email: user.email, role: user.role };
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
});
