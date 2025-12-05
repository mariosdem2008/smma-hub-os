// In Auth.tsx - This is causing the redirect!
useEffect(() => {
  const clearStaleSession = async () => {
    // If there's a user but we're on the auth page, verify they exist
    if (user && !loading) {
      try {
        // Try to fetch the user's agency to verify they exist
        const { data, error } = await supabase.from("agencies").select("id").eq("user_id", user.id).maybeSingle();

        // Also check if they're a team member
        const { data: memberData } = await supabase
          .from("agency_members")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        // If user exists in database, redirect to dashboard
        if ((data || memberData) && !error) {
          navigate("/dashboard");
        } else {
          // User was deleted from database but session exists - clear it
          await supabase.auth.signOut();
          toast({
            title: "Session expired",
            description: "Please sign in again",
            variant: "destructive",
          });
        }
      } catch (err) {
        // On error, clear the session
        await supabase.auth.signOut();
      }
    }
  };

  clearStaleSession();
}, [user, loading, navigate, toast]); // ← This runs EVERY TIME user or loading changes!
