import { OptimizerForm } from "@/components/optimizer-form";
import { SearchHistory } from "@/components/search-history";

export default function OptimizerPage() {
  return (
    <div className="flex flex-col gap-10 px-5 py-8 sm:px-7 sm:py-[30px]">
      <OptimizerForm />
      <div className="mx-auto w-full max-w-[1080px]">
        <SearchHistory />
      </div>
    </div>
  );
}
