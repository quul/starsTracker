import Image from 'next/image'
import { getServerSession } from "next-auth/next"
import {authOptions} from "@/app/api/auth/[...nextauth]/route";


export default function Home() {
  const session = getServerSession()
  return (
    <main>

    </main>
  )
}
