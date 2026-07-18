import { supabaseAdmin } from "@/lib/supabase";
import { Contact, Tag } from "@/types";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

async function getActiveUserId(): Promise<string> {
  const { data: { user } } = await supabaseAdmin.auth.getUser().catch(() => ({ data: { user: null } }));
  return user?.id || DEFAULT_USER_ID;
}

// 1. Fetch tags
export async function getTags(): Promise<Tag[]> {
  try {
    const userId = await getActiveUserId();
    const { data, error } = await supabaseAdmin
      .from("tags")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Error fetching tags:", err);
    return [];
  }
}

// 2. Create Tag
export async function createTag(name: string, color: string = "#6366f1"): Promise<Tag> {
  const userId = await getActiveUserId();
  const { data, error } = await supabaseAdmin
    .from("tags")
    .upsert({ user_id: userId, name, color }, { onConflict: "user_id,name" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// 3. Fetch Contacts (with Search, Tag filtering, and associated Tags)
export async function getContacts(search?: string, tagId?: string): Promise<Contact[]> {
  try {
    const userId = await getActiveUserId();
    let query = supabaseAdmin
      .from("contacts")
      .select(`
        *,
        contact_tags!inner (tag_id),
        tags:contact_tags(tag_id, tags(*))
      `)
      .eq("user_id", userId);

    // If tag filter is not present, we want to fetch contacts with optional tags (left join)
    // Supabase !inner join filters contacts. We write alternative queries:
    if (tagId) {
      // With tag filtering
      const { data, error } = await supabaseAdmin
        .from("contacts")
        .select(`
          *,
          contact_tags!inner (tag_id),
          tags:contact_tags(tags(*))
        `)
        .eq("user_id", userId)
        .eq("contact_tags.tag_id", tagId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((c: any) => ({
        ...c,
        tags: c.tags?.map((t: any) => t.tags).filter(Boolean) || [],
      }));
    } else {
      // Without tag filtering
      const { data, error } = await supabaseAdmin
        .from("contacts")
        .select(`
          *,
          tags:contact_tags(tags(*))
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      let contacts = (data || []).map((c: any) => ({
        ...c,
        tags: c.tags?.map((t: any) => t.tags).filter(Boolean) || [],
      }));

      if (search) {
        const s = search.toLowerCase();
        contacts = contacts.filter(
          (c) =>
            c.first_name.toLowerCase().includes(s) ||
            c.last_name.toLowerCase().includes(s) ||
            c.email.toLowerCase().includes(s) ||
            (c.company && c.company.toLowerCase().includes(s))
        );
      }
      return contacts;
    }
  } catch (err) {
    console.error("Error getting contacts:", err);
    return [];
  }
}

// 4. Create Contact
export async function createContact(
  contact: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at" | "tags">,
  tagIds: string[] = []
): Promise<Contact> {
  const userId = await getActiveUserId();
  
  // Insert contact
  const { data: newContact, error: contactError } = await supabaseAdmin
    .from("contacts")
    .insert({
      user_id: userId,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      company: contact.company || null,
      phone: contact.phone || null,
      notes: contact.notes || null,
    })
    .select()
    .single();

  if (contactError) throw new Error(contactError.message);

  // Link tags
  if (tagIds.length > 0) {
    const tagLinks = tagIds.map((tagId) => ({
      contact_id: newContact.id,
      tag_id: tagId,
    }));
    const { error: linkError } = await supabaseAdmin.from("contact_tags").insert(tagLinks);
    if (linkError) console.error("Error linking tags to contact:", linkError);
  }

  return newContact;
}

// 5. Update Contact
export async function updateContact(
  contactId: string,
  contact: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at" | "tags">,
  tagIds: string[] = []
): Promise<void> {
  // Update details
  const { error: contactError } = await supabaseAdmin
    .from("contacts")
    .update({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      company: contact.company || null,
      phone: contact.phone || null,
      notes: contact.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId);

  if (contactError) throw new Error(contactError.message);

  // Remove old tags link
  await supabaseAdmin.from("contact_tags").delete().eq("contact_id", contactId);

  // Add new tags link
  if (tagIds.length > 0) {
    const tagLinks = tagIds.map((tagId) => ({
      contact_id: contactId,
      tag_id: tagId,
    }));
    const { error: linkError } = await supabaseAdmin.from("contact_tags").insert(tagLinks);
    if (linkError) console.error("Error updating tags linking:", linkError);
  }
}

// 6. Delete Contact
export async function deleteContact(contactId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("contacts").delete().eq("id", contactId);
  if (error) throw new Error(error.message);
}

// 7. Bulk Import (with optional tag linking)
export async function importContacts(
  contactsList: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at" | "tags">[],
  tagIds: string[] = []
): Promise<{ importedCount: number; duplicatesRemoved: number }> {
  const userId = await getActiveUserId();
  if (contactsList.length === 0) return { importedCount: 0, duplicatesRemoved: 0 };

  // Filter out internal duplicates in the import batch (prefer first occurrence)
  const uniqueBatchMap = new Map<string, typeof contactsList[0]>();
  for (const c of contactsList) {
    const emailKey = c.email.toLowerCase().trim();
    if (!uniqueBatchMap.has(emailKey)) {
      uniqueBatchMap.set(emailKey, c);
    }
  }

  const uniqueList = Array.from(uniqueBatchMap.values());
  const initialCount = contactsList.length;
  const batchRemoved = initialCount - uniqueList.length;

  // Insert contacts
  const contactsToInsert = uniqueList.map((c) => ({
    user_id: userId,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email.toLowerCase().trim(),
    company: c.company || null,
    phone: c.phone || null,
    notes: c.notes || null,
  }));

  // Perform upsert or insert. Let's do bulk insert.
  // Note: Standard Supabase client limits single insert arrays, but 1000-5000 is perfectly safe.
  const { data: insertedContacts, error } = await supabaseAdmin
    .from("contacts")
    .insert(contactsToInsert)
    .select("id");

  if (error) throw new Error(error.message);

  // Link tags to all imported contacts
  if (tagIds.length > 0 && insertedContacts && insertedContacts.length > 0) {
    const tagLinks = insertedContacts.flatMap((c) =>
      tagIds.map((tagId) => ({
        contact_id: c.id,
        tag_id: tagId,
      }))
    );
    
    // Insert tag connections in chunks to avoid payload size errors
    const chunkSize = 1000;
    for (let i = 0; i < tagLinks.length; i += chunkSize) {
      const chunk = tagLinks.slice(i, i + chunkSize);
      await supabaseAdmin.from("contact_tags").insert(chunk);
    }
  }

  return {
    importedCount: insertedContacts?.length || 0,
    duplicatesRemoved: batchRemoved,
  };
}

// 8. Remove duplicate emails from database
export async function removeDuplicateContacts(): Promise<number> {
  const userId = await getActiveUserId();

  // Find all contacts for user
  const { data: contacts, error } = await supabaseAdmin
    .from("contacts")
    .select("id, email, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true }); // oldest first

  if (error) throw error;
  if (!contacts || contacts.length === 0) return 0;

  const emailsSeen = new Set<string>();
  const idsToDelete: string[] = [];

  for (const c of contacts) {
    const email = c.email.toLowerCase().trim();
    if (emailsSeen.has(email)) {
      idsToDelete.push(c.id);
    } else {
      emailsSeen.add(email);
    }
  }

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from("contacts")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) throw deleteError;
  }

  return idsToDelete.length;
}
