import SwiftUI
import SwiftData

struct AddExpenseView: View {
    @Environment(\.modelContext) private var context; @Environment(\.dismiss) private var dismiss
    @State private var amount=""; @State private var category="Market"; @State private var merchant=""; @State private var payment="Nakit"; @State private var note=""
    let categories=["Market","Giyim","Elektronik","Ev","Restoran","Kişisel Bakım","Diğer"]; let payments=["Nakit","Banka Kartı","Kredi Kartı","Havale/EFT"]
    var body: some View { Form { TextField("Tutar",text:$amount).keyboardType(.decimalPad); Picker("Kategori",selection:$category){ForEach(categories,id:\.self){Text($0)}}; TextField("Mağaza",text:$merchant); Picker("Ödeme",selection:$payment){ForEach(payments,id:\.self){Text($0)}}; TextField("Açıklama",text:$note); Button("Kaydet"){context.insert(Expense(amount:Double(amount.replacingOccurrences(of:",",with:".")) ?? 0,category:category,merchant:merchant,paymentMethod:payment,note:note));dismiss()} }.navigationTitle("Harcama Ekle") }
}
struct AddIncomeView: View {
    @Environment(\.modelContext) private var context; @Environment(\.dismiss) private var dismiss; @State private var amount=""; @State private var source=""; @State private var note=""
    var body: some View { Form { TextField("Tutar",text:$amount).keyboardType(.decimalPad); TextField("Gelir kaynağı",text:$source); TextField("Açıklama",text:$note); Button("Kaydet"){context.insert(Income(amount:Double(amount.replacingOccurrences(of:",",with:".")) ?? 0,source:source,note:note));dismiss()} }.navigationTitle("Gelir Ekle") }
}
struct AddDebtView: View {
    @Environment(\.modelContext) private var context; @Environment(\.dismiss) private var dismiss; @State private var person=""; @State private var amount=""; @State private var direction="Bana borçlu"
    var body: some View { Form { TextField("Kişi",text:$person); TextField("Tutar",text:$amount).keyboardType(.decimalPad); Picker("Durum",selection:$direction){Text("Bana borçlu").tag("Bana borçlu");Text("Ben borçluyum").tag("Ben borçluyum")}; Button("Kaydet"){context.insert(Debt(person:person,amount:Double(amount.replacingOccurrences(of:",",with:".")) ?? 0,direction:direction));dismiss()} }.navigationTitle("Borç Ekle") }
}
struct VehiclesView:View{var body:some View{Placeholder(title:"Araçlar",icon:"car.fill")}}
struct BillsView:View{var body:some View{Placeholder(title:"Faturalar",icon:"doc.text.fill")}}
struct HealthView:View{var body:some View{Placeholder(title:"Sağlık",icon:"cross.case.fill")}}
struct AccountsView:View{var body:some View{Placeholder(title:"Hesaplar & Kartlar",icon:"creditcard.fill")}}
struct DebtsView:View{var body:some View{Placeholder(title:"Borçlar",icon:"person.2.fill")}}
struct MembersView:View{var body:some View{Placeholder(title:"Üyeler",icon:"person.3.fill")}}
struct SettingsView:View{var body:some View{Placeholder(title:"Ayarlar",icon:"gearshape.fill")}}
