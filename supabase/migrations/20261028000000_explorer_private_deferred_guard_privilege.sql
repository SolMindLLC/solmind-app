-- SolMind MVP0 private Explorer deferred policy guard privilege.
-- Run the existing coherence check as its existing postgres owner when a
-- deferred trigger fires after the security-definer RPC has returned.
-- Preserve the function body, empty search_path, owner, trigger timing and ACLs.
-- No users, seed data, schema/table/function grants, policies or provider calls.
begin;

alter function ai.solmind_private_policy_coherent_v3() security definer;

commit;
