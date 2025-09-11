import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type SortKey = "arrival" | "registration" | "renewal"
type SortDir = "asc" | "desc"

export default function SortDropdown({
  sortKey,
  sortDir,
  setSortKey,
  setSortDir,
}: {
  sortKey: SortKey
  sortDir: SortDir
  setSortKey: (k: SortKey) => void
  setSortDir: (d: SortDir) => void
}) {
  const toggleDir = () => setSortDir(sortDir === "asc" ? "desc" : "asc")
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="border-white/10 bg-white/10 text-gray-100 hover:bg-white/20">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Sort by:
            <span className="ml-1 font-medium">
              {sortKey === "arrival"
                ? "Arrival"
                : sortKey === "registration"
                ? "Registration price"
                : "Renewal price"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="glass-card border-0 bg-gray-900/80 backdrop-blur-md"
        >
          <DropdownMenuItem
            onClick={() => setSortKey("arrival")}
            className="cursor-pointer hover:bg-white/10"
          >
            Arrival (sequence)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setSortKey("registration")}
            className="cursor-pointer hover:bg-white/10"
          >
            Registration price
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setSortKey("renewal")}
            className="cursor-pointer hover:bg-white/10"
          >
            Renewal price
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="icon"
        onClick={toggleDir}
        className="border-white/10 bg-white/10 text-gray-100 hover:bg-white/20"
        title={`Toggle ${sortDir === "asc" ? "descending" : "ascending"}`}
      >
        {sortDir === "asc" ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}