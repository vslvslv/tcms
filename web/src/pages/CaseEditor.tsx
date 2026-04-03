import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { TestCaseForm } from "../components/TestCaseForm";

export default function CaseEditor() {
  const { caseId, sectionId } = useParams<{ caseId?: string; sectionId?: string }>();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("templateId");
  const navigate = useNavigate();
  const isNew = !caseId;

  if (isNew && sectionId) {
    return (
      <div className="max-w-2xl">
        <TestCaseForm
          sectionId={sectionId}
          templateId={templateId ?? undefined}
          onCancel={() => navigate(-1)}
        />
      </div>
    );
  }

  if (caseId) {
    return (
      <div className="max-w-2xl">
        <TestCaseForm caseId={caseId} onCancel={() => navigate(-1)} />
      </div>
    );
  }

  return (
    <p className="text-muted">
      No section or case selected. Open a case from the overview or create one from a section.
    </p>
  );
}
