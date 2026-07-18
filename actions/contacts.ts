"use server";

import { 
  getContacts, 
  getTags, 
  createTag, 
  createContact, 
  updateContact, 
  deleteContact, 
  importContacts, 
  removeDuplicateContacts 
} from "@/services/contacts";
import { Contact } from "@/types";

export async function getContactsAction(search?: string, tagId?: string) {
  try {
    const contacts = await getContacts(search, tagId);
    return { success: true, data: contacts };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch contacts" };
  }
}

export async function getTagsAction() {
  try {
    const tags = await getTags();
    return { success: true, data: tags };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to fetch tags" };
  }
}

export async function createTagAction(name: string, color?: string) {
  try {
    const tag = await createTag(name, color);
    return { success: true, data: tag };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create tag" };
  }
}

export async function createContactAction(
  contact: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at" | "tags">,
  tagIds: string[] = []
) {
  try {
    const newContact = await createContact(contact, tagIds);
    return { success: true, data: newContact };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create contact" };
  }
}

export async function updateContactAction(
  contactId: string,
  contact: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at" | "tags">,
  tagIds: string[] = []
) {
  try {
    await updateContact(contactId, contact, tagIds);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update contact" };
  }
}

export async function deleteContactAction(contactId: string) {
  try {
    await deleteContact(contactId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete contact" };
  }
}

export async function importContactsAction(
  contactsList: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at" | "tags">[],
  tagIds: string[] = []
) {
  try {
    const stats = await importContacts(contactsList, tagIds);
    return { success: true, ...stats };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to import contacts" };
  }
}

export async function removeDuplicateContactsAction() {
  try {
    const removedCount = await removeDuplicateContacts();
    return { success: true, removedCount };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to remove duplicates" };
  }
}
