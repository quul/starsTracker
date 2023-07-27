import Image from 'next/image'
import { getServerSession } from "next-auth/next"
import {authOptions} from "@/lib/nextAuth";


export default function Home() {
  const session = getServerSession(authOptions)
  return (
    <main>

    </main>
  )
}
