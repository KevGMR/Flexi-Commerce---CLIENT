import Link from "next/link";

export function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2">
      <span className="text-lg font-bold">
        <span className="text-blue-600">FLEXI</span>
        <span className="text-zinc-900">-COMMERCE</span>
      </span>
    </Link>
  );
}
