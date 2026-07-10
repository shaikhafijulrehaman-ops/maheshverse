import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fzoesehhjgtgrdwkepzk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b2VzZWhoamd0Z3Jkd2tlcHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NzU1MzcsImV4cCI6MjA5OTI1MTUzN30.A7jJLho8UsrYaJCWRK_iXElpV7RktE7bGbb9BcyT8K4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const supabaseClient = {
  isEnabled: false, // Routed directly to Supabase production

  // Upload property image to Storage bucket "property-images"
  async uploadImage(file) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `sell-listings/${fileName}`;

      const { error } = await supabase.storage
        .from('property-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('property-images')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('Supabase image upload failed:', err);
      throw err;
    }
  },

  // Leads CRUD
  async getLeads() {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(item => this.mapLeadFromDB(item));
  },

  async createLead(leadData) {
    const dbData = this.mapLeadToDB(leadData);
    const { data, error } = await supabase
      .from('leads')
      .insert([dbData])
      .select()
      .single();

    if (error) throw error;
    return this.mapLeadFromDB(data);
  },

  async updateLeadStatus(id, status) {
    const { data, error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapLeadFromDB(data);
  },

  async deleteLead(id) {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // Locations CRUD
  async getLocations() {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('order', { ascending: true });

    if (error) throw error;
    return (data || []).map(l => ({
      _id: l.id,
      id: l.id,
      name: l.name,
      isHidden: l.is_hidden,
      order: l.order
    }));
  },

  async createLocation(locationData) {
    const { data, error } = await supabase
      .from('locations')
      .insert([{
        name: locationData.name,
        is_hidden: locationData.isHidden || false,
        order: parseInt(locationData.order || 0)
      }])
      .select()
      .single();

    if (error) throw error;
    return {
      _id: data.id,
      id: data.id,
      name: data.name,
      isHidden: data.is_hidden,
      order: data.order
    };
  },

  async updateLocation(id, locationData) {
    const { data, error } = await supabase
      .from('locations')
      .update({
        name: locationData.name,
        is_hidden: locationData.isHidden,
        order: parseInt(locationData.order || 0)
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return {
      _id: data.id,
      id: data.id,
      name: data.name,
      isHidden: data.is_hidden,
      order: data.order
    };
  },

  async deleteLocation(id) {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // Property Types CRUD
  async getPropertyTypes() {
    const { data, error } = await supabase
      .from('property_types')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(p => ({
      _id: p.id,
      id: p.id,
      name: p.name,
      isEnabled: p.is_enabled
    }));
  },

  async createPropertyType(typeData) {
    const { data, error } = await supabase
      .from('property_types')
      .insert([{
        name: typeData.name,
        is_enabled: typeData.isEnabled ?? true
      }])
      .select()
      .single();

    if (error) throw error;
    return {
      _id: data.id,
      id: data.id,
      name: data.name,
      isEnabled: data.is_enabled
    };
  },

  async updatePropertyType(id, typeData) {
    const { data, error } = await supabase
      .from('property_types')
      .update({
        name: typeData.name,
        is_enabled: typeData.isEnabled
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return {
      _id: data.id,
      id: data.id,
      name: data.name,
      isEnabled: data.is_enabled
    };
  },

  async deletePropertyType(id) {
    const { error } = await supabase
      .from('property_types')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // Followups CRUD
  async getFollowups(leadId) {
    const { data, error } = await supabase
      .from('followups')
      .select('*')
      .eq('lead_id', leadId)
      .order('date', { ascending: false });

    if (error) throw error;
    return (data || []).map(f => ({
      _id: f.id,
      id: f.id,
      leadId: f.lead_id,
      date: f.date,
      notes: f.notes,
      createdAt: f.created_at
    }));
  },

  async createFollowup(leadId, date, notes) {
    const { data, error } = await supabase
      .from('followups')
      .insert([{
        lead_id: leadId,
        date: date,
        notes: notes
      }])
      .select()
      .single();

    if (error) throw error;
    return {
      _id: data.id,
      id: data.id,
      leadId: data.lead_id,
      date: data.date,
      notes: data.notes,
      createdAt: data.created_at
    };
  },

  // Notifications CRUD
  async getNotifications() {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data || [];
  },

  async markNotificationRead(id) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async markAllNotificationsRead() {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false);

    if (error) throw error;
    return true;
  },

  async createNotification(message, type = 'info') {
    const { data, error } = await supabase
      .from('notifications')
      .insert([{ message, type }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 2-hour deduplication check
  async checkDuplicateLead(phone, type) {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', phone.trim())
      .eq('type', type)
      .gt('created_at', twoHoursAgo)
      .not('status', 'in', '("closed","rejected")')
      .limit(1);

    if (error) throw error;
    return (data && data.length > 0);
  },

  // Client Analytics Generator
  async getAnalytics() {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('created_at, type, status, preferred_location, location');

    if (error) throw error;

    const totalLeads = leads.length;
    const today = new Date().toDateString();
    const todayLeads = leads.filter(l => new Date(l.created_at).toDateString() === today).length;
    const closedDeals = leads.filter(l => l.status === 'closed').length;
    
    const locationCounts = {};
    leads.forEach(l => {
      const loc = l.type === 'buy' ? l.preferred_location : l.location;
      if (loc) {
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
      }
    });

    const topLocations = Object.keys(locationCounts).map(name => ({
      name,
      count: locationCounts[name]
    })).sort((a, b) => b.count - a.count);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyGroups = {};
    leads.forEach(l => {
      const dt = new Date(l.created_at);
      const key = `${monthNames[dt.getMonth()]} ${dt.getFullYear()}`;
      if (!monthlyGroups[key]) {
        monthlyGroups[key] = { name: key, total: 0, buy: 0, sell: 0 };
      }
      monthlyGroups[key].total += 1;
      if (l.type === 'buy') monthlyGroups[key].buy += 1;
      else monthlyGroups[key].sell += 1;
    });

    const monthlyTrends = Object.values(monthlyGroups).reverse().slice(0, 6);

    return {
      summary: {
        totalLeads,
        todayLeads,
        closedDeals,
        pendingFollowups: leads.filter(l => !['closed', 'rejected'].includes(l.status)).length,
        conversionRate: totalLeads > 0 ? Math.round((closedDeals / totalLeads) * 100) : 0,
        buyRequests: leads.filter(l => l.type === 'buy').length,
        sellRequests: leads.filter(l => l.type === 'sell').length
      },
      topLocations,
      monthlyTrends
    };
  },

  // Helper Mappers between schema shapes
  mapLeadToDB(lead) {
    return {
      type: lead.type,
      status: lead.status || 'new',
      name: lead.personalInfo.name,
      phone: lead.personalInfo.phone,
      email: lead.personalInfo.email,
      preferred_location: lead.buyDetails?.preferredLocation,
      property_type: lead.type === 'buy' ? lead.buyDetails?.propertyType : lead.sellDetails?.propertyType,
      other_property_type: lead.type === 'buy' ? lead.buyDetails?.otherPropertyType : lead.sellDetails?.otherPropertyType,
      bhk: lead.buyDetails?.bhk,
      min_budget: parseFloat(lead.buyDetails?.minBudget || 0),
      max_budget: parseFloat(lead.buyDetails?.maxBudget || 0),
      loan_required: lead.buyDetails?.loanRequired,
      ready_to_move: lead.buyDetails?.readyToMove,
      additional_requirements: lead.buyDetails?.additionalRequirements,
      location: lead.sellDetails?.location,
      construction_type: lead.sellDetails?.constructionType,
      size: lead.sellDetails?.size,
      facing: lead.sellDetails?.facing,
      age: lead.sellDetails?.age,
      expected_price: parseFloat(lead.sellDetails?.expectedPrice || 0),
      images: lead.sellDetails?.images || [],
      additional_information: lead.sellDetails?.additionalInformation
    };
  },

  mapLeadFromDB(item) {
    return {
      _id: item.id,
      id: item.id,
      type: item.type,
      status: item.status,
      createdAt: item.created_at,
      personalInfo: {
        name: item.name,
        phone: item.phone,
        email: item.email
      },
      buyDetails: item.type === 'buy' ? {
        preferredLocation: item.preferred_location,
        propertyType: item.property_type,
        otherPropertyType: item.other_property_type,
        bhk: item.bhk,
        minBudget: item.min_budget,
        maxBudget: item.max_budget,
        loanRequired: item.loan_required,
        readyToMove: item.ready_to_move,
        additionalRequirements: item.additional_requirements
      } : null,
      sellDetails: item.type === 'sell' ? {
        location: item.location,
        propertyType: item.property_type,
        otherPropertyType: item.other_property_type,
        constructionType: item.construction_type,
        size: item.size,
        facing: item.facing,
        age: item.age,
        expectedPrice: item.expected_price,
        images: item.images || [],
        additionalInformation: item.additional_information
      } : null
    };
  }
};
