import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Team() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the new team settings page
    navigate("/settings/team", { replace: true });
  }, [navigate]);

  return null;
}
