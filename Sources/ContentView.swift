import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            DashboardView().tabItem { Label("Ana Sayfa", systemImage: "house.fill") }
            ExpensesView().tabItem { Label("Harcamalar", systemImage: "creditcard.fill") }
            InvestmentsView().tabItem { Label("Yatırımlar", systemImage: "chart.line.uptrend.xyaxis") }
            ReportsView().tabItem { Label("Raporlar", systemImage: "chart.bar.fill") }
            MoreView().tabItem { Label("Daha Fazla", systemImage: "ellipsis.circle.fill") }
        }
    }
}

struct DashboardView: View {
    var body: some View {
        NavigationStack {
            List {
                Section("Bu Ay") {
                    SummaryRow(title: "Gelir", value: "0,00 TL", icon: "arrow.down.circle")
                    SummaryRow(title: "Gider", value: "0,00 TL", icon: "arrow.up.circle")
                    SummaryRow(title: "Yatırım", value: "0,00 TL", icon: "chart.line.uptrend.xyaxis")
                    SummaryRow(title: "Kalan", value: "0,00 TL", icon: "wallet.pass")
                }
                Section("Hızlı İşlemler") {
                    NavigationLink("Harcama Ekle", destination: AddExpenseView())
                    NavigationLink("Gelir Ekle", destination: AddIncomeView())
                    NavigationLink("Borç Ekle", destination: AddDebtView())
                }
                Section("Modüller") {
                    NavigationLink("Alışveriş", destination: ExpensesView())
                    NavigationLink("Araçlar", destination: VehiclesView())
                    NavigationLink("Faturalar", destination: BillsView())
                    NavigationLink("Sağlık", destination: HealthView())
                }
            }
            .navigationTitle("Aile Finans")
        }
    }
}

struct SummaryRow: View {
    let title: String; let value: String; let icon: String
    var body: some View {
        HStack { Image(systemName: icon).frame(width: 28); Text(title); Spacer(); Text(value).fontWeight(.semibold) }
    }
}

struct ExpensesView: View {
    var body: some View {
        NavigationStack {
            Placeholder(title: "Harcamalar", icon: "creditcard.fill")
                .toolbar { ToolbarItem(placement: .topBarTrailing) { NavigationLink(destination: AddExpenseView()) { Image(systemName: "plus") } } }
        }
    }
}
struct InvestmentsView: View {
    var body: some View {
        NavigationStack {
            Placeholder(title: "Yatırımlar", icon: "chart.line.uptrend.xyaxis")
                .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Güncelle") {} } }
        }
    }
}
struct ReportsView: View { var body: some View { NavigationStack { Placeholder(title: "Raporlar", icon: "chart.bar.fill") } } }
struct MoreView: View {
    var body: some View {
        NavigationStack {
            List {
                NavigationLink("Hesaplar & Kartlar", destination: AccountsView())
                NavigationLink("Borçlar", destination: DebtsView())
                NavigationLink("Üyeler", destination: MembersView())
                NavigationLink("Araçlar", destination: VehiclesView())
                NavigationLink("Faturalar", destination: BillsView())
                NavigationLink("Sağlık", destination: HealthView())
                NavigationLink("Ayarlar", destination: SettingsView())
            }.navigationTitle("Daha Fazla")
        }
    }
}
struct Placeholder: View {
    let title: String; let icon: String
    var body: some View {
        VStack(spacing: 16) { Image(systemName: icon).font(.system(size: 48)); Text(title).font(.title2).fontWeight(.semibold); Text("Bu bölüm geliştirilecek.").foregroundStyle(.secondary) }
            .frame(maxWidth: .infinity, maxHeight: .infinity).navigationTitle(title)
    }
}
